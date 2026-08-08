import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ToggleLeft = forwardRef(function ToggleLeft(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="9" cy="12" r="3" />
      <rect width="20" height="14" x="2" y="5" rx="7" />
    </CridoraIcon>
  )
})

export default ToggleLeft
