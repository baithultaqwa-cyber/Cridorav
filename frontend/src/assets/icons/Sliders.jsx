import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Sliders = forwardRef(function Sliders(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M10 8h4" />
      <path d="M12 21v-9" />
      <path d="M12 8V3" />
      <path d="M17 16h4" />
      <path d="M19 12V3" />
      <path d="M19 21v-5" />
      <path d="M3 14h4" />
      <path d="M5 10V3" />
      <path d="M5 21v-7" />
    </CridoraIcon>
  )
})

export default Sliders
