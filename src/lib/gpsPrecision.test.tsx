import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {assessGpsPrecision,gpsAccuracyLabel,GPS_OPERATIONAL_MAX_METERS,GPS_PREFERRED_MAX_METERS} from "./gpsPrecision";
import {GpsPrecisionMonitor} from "../components/GpsPrecisionMonitor";
import {isRecentLocationSample,validLocation,GpsAttemptLedger} from "./gpsAttemptLedger";

const base={latitude:-27.6,longitude:-48.6,accuracy:20,timestamp:1_000_000};
const now=1_000_100;

describe("GPS accuracy bands: display and safe operations",()=>{
  it.each([
    [0,"excellent",true,true],
    [3.5,"excellent",true,true],
    [20,"excellent",true,true],
    [20.001,"good",true,true],
    [50,"good",true,true],
    [50.001,"reduced",true,false],
    [100,"reduced",true,false],
    [249.99,"reduced",true,false],
    [250,"reduced",true,false],
    [250.001,"unreliable",false,false],
    [251,"unreliable",false,false],
    [500,"unreliable",false,false],
    [9999,"unreliable",false,false],
  ] as const)("classifies %s meters as %s",(meters,level,operational,preferred)=>{
    expect(assessGpsPrecision(meters)).toMatchObject({level,operational,preferred});
    expect(validLocation({...base,accuracy:meters},now)).toBe(operational);
  });
  it.each([null,undefined,NaN,Infinity,-Infinity,-1,"20",{},[]])
    ("refuses unavailable or invalid accuracy: %s",value=>{
      expect(assessGpsPrecision(value)).toMatchObject({level:"unavailable",operational:false,preferred:false});
    });
  it("never rounds a just-over-limit value down to 250m",()=>{
    expect(gpsAccuracyLabel(250.001)).toBe("251 m");
    expect(gpsAccuracyLabel(12.3)).toBe("13 m");
    expect(gpsAccuracyLabel(null)).toBe("—");
    expect(GPS_PREFERRED_MAX_METERS).toBe(50);
    expect(GPS_OPERATIONAL_MAX_METERS).toBe(250);
  });
  it("reports poor fresh measurement to UI but never authorizes it for API upload",()=>{
    const sample={...base,accuracy:400};
    expect(isRecentLocationSample(sample,now)).toBe(true);
    expect(validLocation(sample,now)).toBe(false);
    const attempts=new GpsAttemptLedger();
    expect(attempts.beginAttempt(2,3,sample,now)).toBe(false);
    expect(attempts.beginAttempt(2,3,{...sample,accuracy:30},now)).toBe(true);
  });
  it("does not display stale precision even if watch no longer updates",()=>{
    const stale=renderToStaticMarkup(<GpsPrecisionMonitor active={true} accuracyMeters={11}
      measuredAt={1_000_000} now={1_030_001}/>);
    expect(stale).toContain("Aguardando medição");
    expect(stale).not.toContain("11 m");
    const fresh=renderToStaticMarkup(<GpsPrecisionMonitor active={true} accuracyMeters={11}
      measuredAt={1_000_000} now={1_000_100}/>);
    expect(fresh).toContain("11 m");
    expect(fresh).toContain("Excelente");
    expect(fresh).not.toContain("-27.6");
    expect(fresh).not.toContain("-48.6");
  });
  it("clears visually while GPS consent is turned off",()=>{
    const html=renderToStaticMarkup(<GpsPrecisionMonitor active={false} accuracyMeters={9}
      measuredAt={1_000_000} now={1_000_100}/>);
    expect(html).toContain("Aguardando medição");
    expect(html).toContain("Ative o compartilhamento");
    expect(html).not.toContain("9 m");
  });
  it("shows reduced accuracy as a warning, and poor fix as blocked",()=>{
    const warning=renderToStaticMarkup(<GpsPrecisionMonitor active={true} accuracyMeters={80}
      measuredAt={1_000_000} now={1_000_100}/>);
    expect(warning).toContain("Precisão reduzida");
    expect(warning).toContain("80 m");
    const blocked=renderToStaticMarkup(<GpsPrecisionMonitor active={true} accuracyMeters={300}
      measuredAt={1_000_000} now={1_000_100}/>);
    expect(blocked).toContain("Não confiável");
    expect(blocked).toContain("não é enviada à central");
  });
});
