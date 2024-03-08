// QR code track function (outline)
export function paintOutline(detectedCodes, ctx) {
  console.log(detectedCodes)
  console.log(ctx)

  if(detectedCodes && detectedCodes.length) {
    for (const detectedCode of detectedCodes) {
      console.log(detectedCode)

      const [firstPoint, ...otherPoints] = detectedCode.cornerPoints

      ctx.strokeStyle = '#007bff'

      ctx.beginPath()
      ctx.moveTo(firstPoint.x, firstPoint.y)
      for (const { x, y } of otherPoints) {
        ctx.lineTo(x, y)
      }
      ctx.lineTo(firstPoint.x, firstPoint.y)
      ctx.closePath()
      ctx.stroke()
    }
  }
}

// QR code track function (bounding box)
function paintBoundingBox(detectedCodes, ctx) {
  for (const detectedCode of detectedCodes) {
    const {
      boundingBox: { x, y, width, height }
    } = detectedCode

    ctx.lineWidth = 2
    ctx.strokeStyle = '#007bff'
    ctx.strokeRect(x, y, width, height)
  }
}