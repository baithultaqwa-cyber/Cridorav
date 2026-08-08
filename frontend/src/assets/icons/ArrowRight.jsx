import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ArrowRight = forwardRef(function ArrowRight(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </CridoraIcon>
  )
})

export default ArrowRight
