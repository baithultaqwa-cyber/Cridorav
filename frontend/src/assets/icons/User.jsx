import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const User = forwardRef(function User(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </CridoraIcon>
  )
})

export default User
