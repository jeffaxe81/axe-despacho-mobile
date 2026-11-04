import {describe,expect,it} from "vitest";
import {shouldTransmitLocation,validLocation} from "./useFieldLocation";

describe("GPS de campo - cadência e coordenada",()=>{
  const point={latitude:-27.1,longitude:-48.6,accuracy:18,timestamp:100_000};
  it("transmite o primeiro ponto e respeita cadência de 20 segundos",()=>{
    expect(shouldTransmitLocation(0,100_000)).toBe(true);
    expect(shouldTransmitLocation(100_000,119_999)).toBe(false);
    expect(shouldTransmitLocation(100_000,120_000)).toBe(true);
  });
  it("rejeita localização ausente ou antiga sem reportar posição fantasma",()=>{
    expect(validLocation(point,100_100)).toBe(true);
    expect(validLocation({...point,latitude:100},100_100)).toBe(false);
    expect(validLocation({...point,longitude:NaN},100_100)).toBe(false);
    expect(validLocation({...point,accuracy:10_001},100_100)).toBe(false);
    expect(validLocation(point,130_001)).toBe(false);
    expect(validLocation(point,90_000)).toBe(false);
  });
});
