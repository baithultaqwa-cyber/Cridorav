import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ArrowLeft = forwardRef(function ArrowLeft(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </CridoraIcon>
  )
})

export default ArrowLeft
