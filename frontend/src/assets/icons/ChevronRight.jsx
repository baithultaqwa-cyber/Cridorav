import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ChevronRight = forwardRef(function ChevronRight(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m9 18 6-6-6-6" />
    </CridoraIcon>
  )
})

export default ChevronRight
