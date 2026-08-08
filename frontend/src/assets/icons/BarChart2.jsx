import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const BarChart2 = forwardRef(function BarChart2(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M5 21v-6" />
      <path d="M12 21V3" />
      <path d="M19 21V9" />
    </CridoraIcon>
  )
})

export default BarChart2
