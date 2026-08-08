import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Mail = forwardRef(function Mail(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </CridoraIcon>
  )
})

export default Mail
