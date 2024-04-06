// QR code track function (outline)
export function paintOutline(detectedCodes, ctx) {
  console.log(detectedCodes)
  console.log(ctx)


  if(detectedCodes && detectedCodes.length) {
    for (const detectedCode of detectedCodes) {
      console.log(detectedCode)

      const [firstPoint, ...otherPoints] = detectedCode.cornerPoints

      ctx.strokeStyle = 'orange'
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

export function paintCenterText(detectedCodes, ctx) {
  if(detectedCodes && detectedCodes.length) {
    for (const detectedCode of detectedCodes) {
      const { boundingBox, rawValue } = detectedCode

      const centerX = boundingBox.x + boundingBox.width / 2
      const centerY = boundingBox.y + boundingBox.height / 2

      const fontSize = Math.max(12, (50 * boundingBox.width) / ctx.canvas.width)

      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textAlign = 'center'

      ctx.lineWidth = 3
      ctx.strokeStyle = '#35495e'
      ctx.strokeText(detectedCode.rawValue, centerX, centerY)

      ctx.fillStyle = '#5cb984'
      ctx.fillText(rawValue, centerX, centerY)
    }
  }
}

// QR code track function (bounding box)
export function paintBoundingBox(detectedCodes, ctx) {
  if(detectedCodes && detectedCodes.length) {
    for (const detectedCode of detectedCodes) {
      const {
        boundingBox: { x, y, width, height }
      } = detectedCode

      ctx.lineWidth = 2
      ctx.strokeStyle = '#007bff'
      ctx.strokeRect(x, y, width, height)
    }
  }
}