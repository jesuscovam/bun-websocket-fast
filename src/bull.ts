import Bull from 'bull'

export const virtualQueue = new Bull(
	'virtual-queue',
	'redis://default:redispw@localhost:32768'
)
export const purchaseQueue = new Bull(
	'purchase-queue',
	'redis://default:redispw@localhost:32768'
)
