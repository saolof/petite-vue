import { Directive } from '.'

export const text: Directive<Text | Element> = ({ el, get, effect }) => {
  effect(() => {
    el.textContent = toDisplayString(get())
  })
}

export const toDisplayString = (value: any) =>
  value == null
    ? ''
    : (typeof value === 'object')
    ? JSON.stringify(value, null, 2)
    : String(value)



