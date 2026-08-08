import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const AlertCircle = forwardRef(function AlertCircle(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </CridoraIcon>
  )
})

export default AlertCircle
