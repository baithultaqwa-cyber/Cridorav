import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const CheckCircle = forwardRef(function CheckCircle(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </CridoraIcon>
  )
})

export default CheckCircle
