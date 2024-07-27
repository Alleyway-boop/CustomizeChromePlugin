export interface IResponse<T> {
  status: number
  data: T
  message: string
}

export function isResponse<T>(obj: any): obj is IResponse<T> {
  return typeof obj === 'object' && 'status' in obj && 'data' in obj && 'message' in obj
}

/** 这个方法能够将传入的 Response 变成原始数据 */
/** 若传入的不是 Response，则原样返回 */
export function unResponse<T>(obj: IResponse<T> | T): T {
  if (isResponse(obj)) {
    return obj.data
  }
  return obj
}
