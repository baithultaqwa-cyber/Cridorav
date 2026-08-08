import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const GripVertical = forwardRef(function GripVertical(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </CridoraIcon>
  )
})

export default GripVertical
