import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Clock = forwardRef(function Clock(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </CridoraIcon>
  )
})

export default Clock
