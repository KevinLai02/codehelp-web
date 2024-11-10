import { SDP_TYPE } from '~/lib/types'
import { PC_CONFIG } from './constant'
import {
    PeerConnectionT,
    SendSDPT,
    HangupT,
    ICE_CONNECTION_STATE,
    CONNECTION_QUALITY,
    MAX_BITRATE,
    IConnectionQuality,
} from './types'
import { socket } from '~/lib/utils'

export let peerConnection: RTCPeerConnection

export const createLocalStream = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        })
        return stream
    } catch (err) {
        console.log('getUserMedia error: ', err)
    }
}

export const createPeerConnection = ({
    roomID,
    localStream,
    remoteVideoRef,
}: PeerConnectionT) => {
    peerConnection = new RTCPeerConnection(PC_CONFIG)

    localStream?.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
            socket?.emit('ice_candidate', roomID, {
                label: e.candidate.sdpMLineIndex,
                id: e.candidate.sdpMid,
                candidate: e.candidate.candidate,
            })
        }
    }

    peerConnection.oniceconnectionstatechange = (e) => {
        const peerConnection = e.target as RTCPeerConnection
        const state = peerConnection.iceConnectionState
        if (state === ICE_CONNECTION_STATE.DISCONNECTED) {
            console.log('other user is disconnected')
        }
        if (
            state === ICE_CONNECTION_STATE.CONNECTED ||
            state === ICE_CONNECTION_STATE.COMPLETED
        ) {
            setInterval(async () => {
                const connectionQuality = await checkConnectionQuality()
                if (connectionQuality) {
                    const maxBitrate = getMaxBitrate(connectionQuality)
                    await adjustMaxBitrate(localStream, maxBitrate)
                }
            }, 1000)
        }
    }

    peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
            const [stream] = event.streams
            remoteVideoRef.current.srcObject = stream
        }
    }
}

export const sendSDP = async ({ type, roomID }: SendSDPT) => {
    try {
        if (!peerConnection) {
            console.log('尚未開啟視訊')
            return
        }

        const method = type === SDP_TYPE.OFFER ? 'createOffer' : 'createAnswer'

        const localSDP = await peerConnection?.[method]({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        })
        await peerConnection?.setLocalDescription(localSDP)
        socket?.emit(type, roomID, peerConnection.localDescription!)
    } catch (err) {
        console.log('error: ', err)
    }
}

export const hangup = ({ roomID, localStream }: HangupT) => {
    if (peerConnection) {
        peerConnection.onicecandidate = null
        peerConnection.onnegotiationneeded = null
        peerConnection?.close()
    }

    localStream.getTracks().forEach((track) => {
        track.stop()
    })

    socket?.emit('hangup', roomID)
}

const adjustMaxBitrate = async (
    localStream: MediaStream,
    maxBitrate: number
) => {
    try {
        const videoTrack = localStream.getVideoTracks()[0]
        const sender: RTCRtpSender | undefined = peerConnection
            .getSenders()
            .find((sender) => sender.track === videoTrack)

        console.log('sender', sender)
        console.log('maxBitrate', maxBitrate)

        if (sender) {
            const params = sender.getParameters()
            params.encodings[0].maxBitrate = maxBitrate
            sender.setParameters(params)
        } else {
            console.log('local video stream is not found.')
        }
    } catch (error) {
        console.log('error', error)
    }
}

const checkConnectionQuality = async (): Promise<IConnectionQuality> => {
    const stats: RTCStatsReport = await peerConnection.getStats()
    let highestPacketLoss = 0
    let highestRTT = 0
    let highestJitter = 0

    stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
            console.log('report >>', report)
            console.log(`Received bitrate: ${report.bytesReceived}`)

            const packetLoss = report.packetsLost / report.packetsReceived || 0
            const rtt = report.roundTripTime || 0
            const jitter = report.jitter || 0

            console.log(
                `Packet Loss: ${(packetLoss * 100).toFixed(2)}%, RTT: ${rtt} ms, Jitter: ${jitter} ms`
            )
            if (
                packetLoss > highestPacketLoss ||
                rtt > highestRTT ||
                jitter > highestJitter
            ) {
                highestPacketLoss = packetLoss
                highestRTT = rtt
                highestJitter = jitter
            }
        }
    })

    return {
        highestPacketLoss,
        highestRTT,
        highestJitter,
    }
}

const getMaxBitrate = ({
    highestPacketLoss,
    highestRTT,
    highestJitter,
}: IConnectionQuality): number => {
    if (highestPacketLoss > 0.1 || highestRTT > 500 || highestJitter > 100) {
        return MAX_BITRATE[CONNECTION_QUALITY.LOW] // 糟糕的網絡，降低品質
    } else if (highestPacketLoss > 0.05 || highestRTT > 300) {
        return MAX_BITRATE[CONNECTION_QUALITY.MEDIUM] // 中等品質
    } else {
        return MAX_BITRATE[CONNECTION_QUALITY.HIGH] // 良好的網絡，保持高品質
    }
}
