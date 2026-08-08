import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const RotateCcw = forwardRef(function RotateCcw(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </CridoraIcon>
  )
})

export default RotateCcw
