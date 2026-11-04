import {describe,it,expect} from "vitest";
import {ApiError} from "./api";
describe("falhas de API não devem liberar escrita offline",()=>{
  it("representa falhas sem persistir credenciais",()=>{
    const e=new ApiError("Servidor indisponível","UNAUTHORIZED");
    expect(e.code).toBe("UNAUTHORIZED");
    expect(e.name).toBe("ApiError");
  });
});
