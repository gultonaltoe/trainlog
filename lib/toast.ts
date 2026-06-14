type ToastType = 'success' | 'error' | 'info'
type ToastFn = (message: string, type: ToastType) => void

let _fn: ToastFn | null = null

export const toast = {
  success: (m: string) => _fn?.(m, 'success'),
  error:   (m: string) => _fn?.(m, 'error'),
  info:    (m: string) => _fn?.(m, 'info'),
  _register: (fn: ToastFn) => { _fn = fn },
}
