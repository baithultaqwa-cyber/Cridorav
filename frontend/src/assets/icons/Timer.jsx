import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Timer = forwardRef(function Timer(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </CridoraIcon>
  )
})

export default Timer
