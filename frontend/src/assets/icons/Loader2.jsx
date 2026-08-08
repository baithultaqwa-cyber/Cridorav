import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Loader2 = forwardRef(function Loader2(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </CridoraIcon>
  )
})

export default Loader2
