import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ChevronLeft = forwardRef(function ChevronLeft(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m15 18-6-6 6-6" />
    </CridoraIcon>
  )
})

export default ChevronLeft
