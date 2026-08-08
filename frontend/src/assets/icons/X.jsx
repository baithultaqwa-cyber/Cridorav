import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const X = forwardRef(function X(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </CridoraIcon>
  )
})

export default X
