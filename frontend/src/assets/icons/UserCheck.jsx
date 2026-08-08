import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const UserCheck = forwardRef(function UserCheck(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m16 11 2 2 4-4" />
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </CridoraIcon>
  )
})

export default UserCheck
