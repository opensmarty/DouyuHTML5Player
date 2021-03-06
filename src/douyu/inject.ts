import { douyuApi, DouyuAPI, ACJ } from './api'
import {onMessage, postMessage} from '../utils'

const emptyFunc = () => {}
let originUse = emptyFunc
let useOrigin = false
declare var window: {
  [key: string]: any
} & Window
function hookFunc (obj: any, funcName: string, newFunc: (func: Function, args: any[]) => any) {
  var old = obj[funcName]
  obj[funcName] = function () {
    return newFunc.call(this, old.bind(this), Array.from(arguments))
  }
}
function getParam(flash: any, name: string) {
  const children = flash.children
  for (let i=0; i<children.length; i++) {
    const param = children[i]
    if (param.name == name) {
      return param.value
    }
  }
  return ''
}
function getRoomIdFromFlash(s: string) {
  return s.split('&').filter(i => i.substr(0,6) == 'RoomId')[0].split('=')[1]
}
function hookH5() {
  const player = window['require']('douyu-liveH5/live/js/player')
  const postReady = (player: any) => {
    const roomId = player.flashvars.RoomId
    console.log('RoomId', roomId)
    const ctr = document.getElementById(player.root.id)
    const box = document.createElement('div')
    box.id = `space_douyu_html5_player`
    ctr.appendChild(box)
    postMessage('VIDEOID', {
        roomId: roomId,
        id: box.id
    })
  }
  const fakePlayer = {
    init (root: HTMLElement, param: any) {
      console.log('fake init', param)
      postReady(param)
    },
    load (param: any) {
      console.log('fake load', param)
      postReady(param)
    }
  }
  if (player === null) {
    console.log('player null, hook `require.use`')
    const oldUse = window.require.use
    hookFunc(window, 'require', (old, args) => {
      const name = args[0]
      if (name === 'douyu-liveH5/live/js/h5') {
        return fakePlayer
      }
      let ret = old.apply(null, args)
      return ret
    })
    window.require.use = oldUse
    hookFunc(window.require, 'use', (old, args) => {
      const name: string = args[0][0]

      if (!useOrigin && name.indexOf('douyu-liveH5/live/js') !== -1) {
        const cb: Function = args[1]

        console.log('require.use', name)
        originUse = () => {
          old.apply(null, args)
        }
        cb(fakePlayer)
      } else {
        let ret = old.apply(null, args)
        return ret
      }
    })
  } else {
    console.error('we have the player. TODO.')
  }
}
hookFunc(document, 'createElement', (old, args) => {
  let ret = old.apply(null, args)
  if (args[0] == 'object') {
    hookFunc(ret, 'setAttribute', (old, args) => {
      // console.log(args)
      if (args[0] == 'data') {
        if (/WebRoom/.test(args[1])) {
          // args[1] = ''
          setTimeout(() => {
            let roomId = getRoomIdFromFlash(getParam(ret, 'flashvars'))
            console.log('RoomId', roomId)
            postMessage('VIDEOID', {
                roomId: roomId,
                id: ret.id
            })
          }, 1)
        }
      }
      return old.apply(null, args)
    })
  }
  return ret
})
hookH5()
let api: DouyuAPI
onMessage('BEGINAPI', async data => {
  // await retry(() => JSocket.init(), 3)
  api = await douyuApi(data.roomId)
  window.api = api
})
onMessage('SENDANMU', data => {
  api.sendDanmu(data)
})
onMessage('ACJ', data => {
  ACJ(data.id, data.data)
})
onMessage('CONTINUE_ORIGIN', data => {
  console.log('...continue')
  useOrigin = true
  originUse()
  originUse = emptyFunc
})