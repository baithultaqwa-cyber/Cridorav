import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const LineChart = forwardRef(function LineChart(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m19 9-5 5-4-4-3 3" />
    </CridoraIcon>
  )
})

export default LineChart
