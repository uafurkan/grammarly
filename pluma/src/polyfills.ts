// Runtime polyfills for older browsers (notably iOS Safari < 17.4, which lacks
// Promise.withResolvers — required by pdfjs-dist v6; without this, every PDF
// import crashes on those devices).

interface PromiseWithResolversShim<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function') {
  ;(Promise as unknown as { withResolvers: <T>() => PromiseWithResolversShim<T> }).withResolvers =
    function withResolvers<T>(): PromiseWithResolversShim<T> {
      let resolve!: (value: T | PromiseLike<T>) => void
      let reject!: (reason?: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }
}

export {}
