import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const BarChart3 = forwardRef(function BarChart3(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </CridoraIcon>
  )
})

export default BarChart3
