import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const XCircle = forwardRef(function XCircle(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </CridoraIcon>
  )
})

export default XCircle
