import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Minus = forwardRef(function Minus(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M5 12h14" />
    </CridoraIcon>
  )
})

export default Minus
