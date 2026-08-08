import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ChevronDown = forwardRef(function ChevronDown(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m6 9 6 6 6-6" />
    </CridoraIcon>
  )
})

export default ChevronDown
