import type { Job } from 'bull'
import { virtualQueue } from './bull'
import type { RequestParams } from './types'

export const getJobById = (j: Job<any>, socketId: string): boolean =>
	j.data.socketId === socketId

export async function getUserPositionInQueue(userId: string): Promise<number> {
	const jobs = await virtualQueue.getWaiting()
	let position = -1

	if (jobs) {
		for (let i = 0; i < jobs.length; i++) {
			if (!jobs[i].data) {
				console.log(`NO SE ENCONTRO LA DATA DE`, i)
			}
			if (jobs[i]) {
				if (jobs[i].data.socketId === userId) {
					position = i
					break
				}
			}
		}
	}
	return position
}

export async function getSocketIdFromRequest(
	req: Request
): Promise<string | Response> {
	try {
		const socketIdString = await req.json()

		if (!socketIdString) {
			return new Response('No socket id provided', { status: 400 })
		}

		const { socketId } = socketIdString as RequestParams
		return socketId
	} catch (error) {
		console.error('Error obteniendo socketId', error)
		return new Response('Error obteniendo socketId', { status: 400 })
	}
}
