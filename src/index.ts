import { purchaseQueue, virtualQueue } from './bull'
import { getJobById, getUserPositionInQueue } from './utils'

interface RequestParams {
	socketId: string
}

const server = Bun.serve<RequestParams>({
	async fetch(req, server) {
		const url = new URL(req.url)

		// WebSocket req
		if (url.pathname === '/') {
			const socketIdString = await req.json()

			if (!socketIdString) {
				return new Response('No socket id provided', { status: 400 })
			}

			const { socketId } = JSON.parse(socketIdString)

			const success = server.upgrade(req, { data: { socketId } })
			if (success) {
				// Bun automatically returns a 101 Switching Protocols
				// if the upgrade succeeds
				return undefined
			}

			// handle HTTP request normally
			return new Response('Hello world!')
		} else if (url.pathname === '/cola_virtual') {
			const socketIdString = await req.json()

			if (!socketIdString) {
				return new Response('No socket id provided', { status: 400 })
			}

			const { socketId } = JSON.parse(socketIdString)

			const shopping = await purchaseQueue.getWaiting()
			if (shopping.length < 1) {
				const firstJobRef = await virtualQueue.getWaiting()
				if (firstJobRef[0]) {
					if (socketId === firstJobRef[0].data.socketId) {
						const userCanBuy = shopping.some((j) => getJobById(j, socketId))
						if (!userCanBuy) {
							const jobInQueue = firstJobRef[0]
							if (jobInQueue && jobInQueue.remove) {
								jobInQueue.remove()
							}
							purchaseQueue
								.add({
									socketId: socketId,
								})
								.then((res) => {})
							return Response.json({
								turno: true,
								position: false,
								waitTime: false,
							})
						} else {
						}
					}
				}
			} else {
			}

			const position = await getUserPositionInQueue(socketId)
			const jobs = await virtualQueue.getJobs([
				'completed',
				'waiting',
				'active',
			])
			const job = jobs.find((j) => getJobById(j, socketId))

			const waitTime = (position - 1) * 350 // Suponiendo que cada turno toma 5 minutos
			if (job) {
				return Response.json({
					turno: false,
					position: position,
					waitTime: waitTime,
				})
			} else {
				return Response.json(
					{
						turno: false,
						position: false,
						waitTime: false,
						message: 'El usuario no está en la cola virtual',
					},
					{ status: 400 }
				)
			}
		}
	},
	websocket: {
		// this is called when a message is received
		async message(ws, message) {
			console.log(`Received ${message}`)
			// send back a message
			ws.send(message)
		},
		async open(ws) {
			ws.subscribe('turno')
			ws.subscribe('userExited')

			const socketId = ws.data.socketId
			const shopping = await purchaseQueue.getWaiting()

			if (shopping.length < 1) {
				purchaseQueue.add({ socketId })
				ws.publish('turno', JSON.stringify({ turno: true, id: socketId }))
			} else {
				virtualQueue.add({ socketId })
				ws.publish('turno', JSON.stringify({ turno: false, id: socketId }))
			}
		}, // a socket is opened
		async close(ws) {
			const socketId = ws.data.socketId
			const jobsInQueue = await virtualQueue.getJobs([
				'completed',
				'waiting',
				'active',
			])
			const jobInQueue = jobsInQueue.find((j) => j.data.socketId === socketId)

			const jobsInPurchase = await purchaseQueue.getJobs([
				'completed',
				'waiting',
				'active',
			])
			const jobInPurchase = jobsInPurchase.find(
				(j) => j.data.socketId === socketId
			)

			if (jobInQueue && jobInQueue.remove) {
				jobInQueue.remove()
				server.publish('userExited', JSON.stringify({ id: socketId }))
			}

			if (jobInPurchase && jobInPurchase.remove) {
				jobInPurchase.remove()
				server.publish('userExited', JSON.stringify({ id: socketId }))
			}
			ws.unsubscribe('turno')
			ws.unsubscribe('userExited')
		}, // a socket is closed
	},
})

console.log(`Listening on ${server.hostname}:${server.port}`)
