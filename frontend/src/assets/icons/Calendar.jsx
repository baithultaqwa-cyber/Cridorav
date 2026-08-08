import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Calendar = forwardRef(function Calendar(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </CridoraIcon>
  )
})

export default Calendar
