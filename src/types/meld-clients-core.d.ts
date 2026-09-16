declare module "meld-clients-core/lib/actions";

declare module "meld-clients-core/lib/actions/index" {
  export function setFetchFunction(fetch: any): {
    type: string;
    payload: any;
  };
}
