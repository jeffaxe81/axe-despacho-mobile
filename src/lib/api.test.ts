import {describe,it,expect} from "vitest";
import {ApiError,assertNativeApiAuthenticationReady} from "./api";
describe("falhas de API não devem liberar escrita offline",()=>{
  it("bloqueia qualquer requisição do WebView nativo enquanto não houver auth própria",()=>{
    expect(()=>assertNativeApiAuthenticationReady(true)).toThrowError(/autenticação seguro/);
    expect(()=>assertNativeApiAuthenticationReady(false)).not.toThrow();
    try{assertNativeApiAuthenticationReady(true);}catch(e){expect((e as ApiError).code).toBe("NATIVE_AUTH_PENDING");}
  });
  it("representa falhas sem persistir credenciais",()=>{
    const e=new ApiError("Servidor indisponível","UNAUTHORIZED");
    expect(e.code).toBe("UNAUTHORIZED");
    expect(e.name).toBe("ApiError");
  });
});
