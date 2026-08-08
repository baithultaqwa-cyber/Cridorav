import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const CheckCheck = forwardRef(function CheckCheck(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </CridoraIcon>
  )
})

export default CheckCheck
