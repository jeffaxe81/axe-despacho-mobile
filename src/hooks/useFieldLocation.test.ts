import {describe,expect,it} from "vitest";
import {shouldTransmitLocation,validLocation,shouldAttemptFreshLocation} from "./useFieldLocation";

describe("GPS de campo - cadência e coordenada",()=>{
  const point={latitude:-27.1,longitude:-48.6,accuracy:18,timestamp:100_000};
  it("transmite o primeiro ponto e respeita cadência de 20 segundos",()=>{
    expect(shouldTransmitLocation(0,100_000)).toBe(true);
    expect(shouldTransmitLocation(100_000,119_999)).toBe(false);
    expect(shouldTransmitLocation(100_000,120_000)).toBe(true);
    expect(shouldTransmitLocation(100_000,99_999)).toBe(false);
  });
  it("não repete um ponto quando o servidor não confirmou a gravação",()=>{
    const now=1_000_000;
    const sample={...point,timestamp:now-1_000};
    expect(shouldAttemptFreshLocation(null,null,sample,now)).toBe(true);
    // Mesmo após timeout e 20 segundos, o timestamp anterior não volta à fila.
    expect(shouldAttemptFreshLocation(now-20_000,sample.timestamp,sample,now)).toBe(false);
    // Uma captura mais recente pode ser enviada somente depois do intervalo mínimo.
    expect(shouldAttemptFreshLocation(now-19_999,sample.timestamp,{...sample,timestamp:now-100},now)).toBe(false);
    expect(shouldAttemptFreshLocation(now-20_000,sample.timestamp,{...sample,timestamp:now-100},now)).toBe(true);
  });
  it("bloqueia amostra com relógio retrocedendo ou referência inválida",()=>{
    const now=1_000_000;
    const sample={...point,timestamp:now-200};
    expect(shouldAttemptFreshLocation(now+1,null,sample,now)).toBe(false);
    expect(shouldAttemptFreshLocation(Number.NaN,null,sample,now)).toBe(false);
    expect(shouldAttemptFreshLocation(null,Number.NaN,sample,now)).toBe(false);
  });
  it("rejeita localização ausente ou antiga sem reportar posição fantasma",()=>{
    expect(validLocation(point,100_100)).toBe(true);
    expect(validLocation({...point,latitude:100},100_100)).toBe(false);
    expect(validLocation({...point,longitude:NaN},100_100)).toBe(false);
    expect(validLocation({...point,accuracy:251},100_100)).toBe(false);
    expect(validLocation(point,130_001)).toBe(false);
    expect(validLocation(point,90_000)).toBe(false);
  });
});
