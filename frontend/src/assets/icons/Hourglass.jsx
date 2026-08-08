import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Hourglass = forwardRef(function Hourglass(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </CridoraIcon>
  )
})

export default Hourglass
