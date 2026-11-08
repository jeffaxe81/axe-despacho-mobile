import { describe, expect, it } from "vitest";
import {
  appendSignaturePoint, canvasSignaturePoint, isMeaningfulSignature,
  MAX_SIGNATURE_POINTS_PER_STROKE, SIGNATURE_HEIGHT, SIGNATURE_WIDTH,
} from "./touchSignature";

describe("touch-signature geometry — laboratory only", () => {
  it("normalizes Android touch positions for responsive width", () => {
    expect(canvasSignaturePoint(200, 80, {left: 50,top: 30,width: 300,height: 110}))
      .toEqual({x: SIGNATURE_WIDTH/2,y: SIGNATURE_HEIGHT/2});
  });
  it("clamps touches to the drawing area", () => {
    expect(canvasSignaturePoint(-100,900,{left:0,top:0,width:300,height:110}))
      .toEqual({x:0,y:SIGNATURE_HEIGHT});
  });
  it("refuses invalid dimensions instead of generating corrupt points", () => {
    expect(()=>canvasSignaturePoint(10,20,{left:0,top:0,width:0,height:200})).toThrow();
    expect(()=>canvasSignaturePoint(Number.NaN,20,{left:0,top:0,width:300,height:200})).toThrow();
  });
  it("ignores stationary noise and enforces a bounded stroke", () => {
    const unchanged=[{x:1,y:1}];
    expect(appendSignaturePoint(unchanged,{x:1.2,y:1.2})).toBe(unchanged);
    expect(appendSignaturePoint(unchanged,{x:10,y:10})).toHaveLength(2);
    const max=Array.from({length:MAX_SIGNATURE_POINTS_PER_STROKE},(_,i)=>({x:i,y:20}));
    expect(appendSignaturePoint(max,{x:2000,y:20})).toBe(max);
  });
  it("rejects taps and single marks that are not signatures", () => {
    expect(isMeaningfulSignature([])).toBe(false);
    expect(isMeaningfulSignature([[{x:0,y:0}]])).toBe(false);
    expect(isMeaningfulSignature([[{x:20,y:20},{x:23,y:20},{x:25,y:20}]])).toBe(false);
  });
  it("accepts visible multi-point handwriting", () => {
    const points=Array.from({length:14},(_,i)=>({x:15+i*10,y:50+Math.sin(i)*20}));
    expect(isMeaningfulSignature([points])).toBe(true);
  });
  it("does not accept malformed coordinates", () => {
    const points=Array.from({length:14},(_,i)=>({x:i*10,y:25+Math.sin(i)*20}));
    points[5].y=Infinity;
    expect(isMeaningfulSignature([points])).toBe(false);
  });
});
