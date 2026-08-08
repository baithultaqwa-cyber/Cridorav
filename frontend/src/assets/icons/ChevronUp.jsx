import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ChevronUp = forwardRef(function ChevronUp(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m18 15-6-6-6 6" />
    </CridoraIcon>
  )
})

export default ChevronUp
