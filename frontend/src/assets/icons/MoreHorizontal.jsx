import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const MoreHorizontal = forwardRef(function MoreHorizontal(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </CridoraIcon>
  )
})

export default MoreHorizontal
