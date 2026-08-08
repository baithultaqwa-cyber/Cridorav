import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const LayoutDashboard = forwardRef(function LayoutDashboard(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </CridoraIcon>
  )
})

export default LayoutDashboard
