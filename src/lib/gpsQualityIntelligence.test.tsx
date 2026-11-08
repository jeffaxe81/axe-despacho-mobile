import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {GpsQualityAssistant} from "../components/GpsQualityAssistant";
import {
  analyzeGpsQuality,appendGpsQualitySample,toGpsAiFeatures,
  validateGpsAiActionCode,GPS_QUALITY_MAX_SAMPLES
} from "./gpsQualityIntelligence";

const now=2_000_000;
const sample=(accuracyMeters:number,offset:number)=>({accuracyMeters,capturedAt:now-5000+offset*100});

describe("GPS quality intelligence — bounded privacy-only observations",()=>{
  it("keeps only 12 recent quality samples, not any coordinates",()=>{
    let history:ReturnType<typeof appendGpsQualitySample>=[];
    for(let i=0;i<30;i++)history=appendGpsQualitySample(history,sample(15+i,i),now);
    expect(history).toHaveLength(GPS_QUALITY_MAX_SAMPLES);
    expect(history[0].accuracyMeters).toBe(33);
    expect(history.at(-1)?.accuracyMeters).toBe(44);
    for(const entry of history){
      expect(Object.keys(entry).sort()).toEqual(["accuracyMeters","capturedAt"]);
    }
    expect(JSON.stringify(history)).not.toMatch(/latitude|longitude|teamId|token|password|incident/i);
  });
  it.each([
    [{accuracyMeters:NaN,capturedAt:now-100},"NaN"],
    [{accuracyMeters:Infinity,capturedAt:now-100},"Infinity"],
    [{accuracyMeters:-1,capturedAt:now-100},"negative"],
    [{accuracyMeters:10001,capturedAt:now-100},"huge"],
    [{accuracyMeters:10,capturedAt:now+1},"future"],
    [{accuracyMeters:10,capturedAt:now-30001},"stale"],
    [{accuracyMeters:10,capturedAt:0.1},"fractional"]
  ])("rejects unsafe sample %s (%s)",(candidate)=>{
    expect(appendGpsQualitySample([],candidate,now)).toEqual([]);
  });
  it("rejects duplicate or older timestamp to prevent trend replay",()=>{
    const a=sample(25,1);
    const h=appendGpsQualitySample([],a,now);
    expect(appendGpsQualitySample(h,{...a,accuracyMeters:1},now)).toEqual(h);
    expect(appendGpsQualitySample(h,{...a,capturedAt:a.capturedAt-1},now)).toEqual(h);
  });
  it("prunes stale data when a new reading arrives",()=>{
    const old=sample(15,0);
    const h=appendGpsQualitySample([],old,now);
    const later=now+31_000;
    expect(appendGpsQualitySample(h,{accuracyMeters:30,capturedAt:later},later))
      .toEqual([{accuracyMeters:30,capturedAt:later}]);
  });
  it.each([
    ["improving",[120,110,100,80,60,40]],
    ["worsening",[30,35,40,70,80,90]],
    ["stable",[20,25,23,22,21,24]]
  ] as const)("finds estimated accuracy trend %s", (expected,values)=>{
    const summary=analyzeGpsQuality(values.map((m,i)=>sample(m,i)),now);
    expect(summary.trend).toBe(expected);
    expect(summary.sampleCount).toBe(6);
  });
  it("flags noisy readings without calculating a new geographic position",()=>{
    const out=analyzeGpsQuality([20,200,21,180].map((m,i)=>sample(m,i)),now);
    expect(out.unstable).toBe(true);
    expect(out.recommendation).toBe("waiting");
    expect(out.explanation).toContain("oscilou");
  });
  it("never authorizes a fix based on advice, even if its median looks good",()=>{
    const out=analyzeGpsQuality([15,20,22,12,300].map((m,i)=>sample(m,i)),now);
    expect(out.recommendation).toBe("move_to_open_area");
    expect(out.explanation).toContain("não pode ser enviada");
    expect(out).not.toHaveProperty("operational");
    expect(out).not.toHaveProperty("latitude");
    expect(out).not.toHaveProperty("longitude");
  });
  it("does not reuse stale observations to justify a recommendation",()=>{
    const out=analyzeGpsQuality([{accuracyMeters:9,capturedAt:now-30_001}],now);
    expect(out).toMatchObject({sampleCount:0,trend:"insufficient",recommendation:"waiting"});
  });
  it("transmits only allowlisted coarse precision signals to a future AI provider",()=>{
    const advice=analyzeGpsQuality([12,14,16,17,20,22].map((m,i)=>sample(m,i)),now);
    const features=toGpsAiFeatures(advice);
    expect(Object.keys(features).sort()).toEqual([
      "medianAccuracyRoundedMeters","sampleCount","schema","trend","unstable"
    ]);
    expect(features.schema).toBe("gps-quality-v1");
    expect(JSON.stringify(features)).not.toMatch(/latitude|longitude|capturedAt|org|team|token|cookie|sms/i);
  });
  it.each(["wait","open_area","precise_permission","check_sky_view"] as const)
    ("accepts allowlisted recommendation code %s",(code)=>{
      expect(validateGpsAiActionCode({action:code})).toBe(code);
    });
  it.each([
    null,[],{action:"send_sms"},{action:"unlock_gps"},{action:"ignore_250m"},
    {action:"open_area",latitude:10},{action:"wait",url:"https://malicious.invalid"},
    {action:7},"wait",{action:"wait",metadata:{}}
  ])("rejects untrusted AI instructions beyond the allowlist: %s",value=>{
    expect(validateGpsAiActionCode(value)).toBeNull();
  });
  it("labels the interface as statistical, not an active model",()=>{
    const html=renderToStaticMarkup(<GpsQualityAssistant active={true}
      history={[15,20,22,25,23,20].map((m,i)=>sample(m,i))} now={now}/>);
    expect(html).toContain("Análise local");
    expect(html).toContain("sem IA externa conectada");
    expect(html).toContain("Leituras recentes");
    expect(html).not.toContain("latitude");
    expect(html).not.toContain("longitude");
  });
  it("conceals all previous observations when the session consent is disabled",()=>{
    const html=renderToStaticMarkup(<GpsQualityAssistant active={false}
      history={[15,20,25].map((m,i)=>sample(m,i))} now={now}/>);
    expect(html).toContain("Aguardando medições");
    expect(html).toContain("Leituras recentes");
    expect(html).not.toContain("Mediana estimada: <b>20 m");
  });
  it.each(Array.from({length:128},(_,i)=>i))
    ("bounded deterministic replay invariant %s",(i)=>{
      const observations=Array.from({length:20},(_,j)=>sample((i*7+j*13)%1000,j));
      const advice=analyzeGpsQuality(observations,now);
      expect(advice.sampleCount).toBeLessThanOrEqual(GPS_QUALITY_MAX_SAMPLES);
      const features=toGpsAiFeatures(advice);
      expect(Number.isFinite(features.medianAccuracyRoundedMeters??0)).toBe(true);
      expect(features).not.toHaveProperty("authorized");
    });
});
