import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const LogOut = forwardRef(function LogOut(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </CridoraIcon>
  )
})

export default LogOut
