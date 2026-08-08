import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Lock = forwardRef(function Lock(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </CridoraIcon>
  )
})

export default Lock
