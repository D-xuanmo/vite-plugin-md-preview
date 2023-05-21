import { createHash } from 'crypto'
import path from 'path'
import type { Transformer, Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import type { Code, HTML, Parent } from 'mdast'

function md5(str: string): string {
  return createHash('md5').update(str).digest('hex')
}

const fileCodeMap = new Map<string, string[]>()

export type CodeBlock = { name: string; path: string; code: string }

export type RemarkVueOptions = {
  file: string
  root: string
  highlighter: (code: string) => string
  remove: (ids: string[]) => void
  update: (blocks: CodeBlock[]) => void
}

export function remarkVue(options: RemarkVueOptions): Plugin {
  const { file, root, highlighter, remove, update } = options
  const resolve = (...args: string[]) => {
    let ret = path.resolve(path.dirname(file), ...args)
    ret = path.relative(root, ret)
    return `/${ret}`
  }
  function transformer(tree): Transformer {
    const oldBlocks = fileCodeMap.get(file) || []
    const blocks: CodeBlock[] = []
    let demoColumns = 1
    tree.children = tree.children.filter((item) => {
      if (item.type === 'yaml') {
        const groups = item.value.match(/columns:\s*(?<columns>\d+)/)?.groups
        if (groups) {
          demoColumns = groups.columns
        }
        return false
      }
      return true
    })
    visit(tree, 'code', (node: Code, i: number, parent: Parent) => {
      const params: string[] = []
      const attrs = (node.meta || '').split(' ').reduce((prev, curr) => {
        const [key, value] = curr.split('=')
        if (typeof value === 'undefined') {
          prev[key] = true
          params.push(`${key}=true`)
        } else {
          prev[key] = value
          params.push(`${key}=${value}`)
        }
        return prev
      }, {} as Record<string, string | boolean>)

      if (node.lang === 'vue') {
        const name = `VueCode${md5(file).substring(0, 8)}I${i}`
        const component = typeof attrs.preview === 'string' ? attrs.preview : 'VueCode'
        const code = highlighter(node.value);
        blocks.push({ name, path: resolve(`./${name}.vue`), code: node.value })
        const demoNode: HTML & { meta: 'vue' } = {
          type: 'html',
          meta: 'vue',
          value: `<${component} source="${encodeURIComponent(code)}" params="${params.join('&')}">
              <${name} />
            </${component}>`,
        }
        parent.children.splice(i, 1, demoNode)
      }
    })
    const names = blocks.map(i => i.name)
    remove(oldBlocks)
    fileCodeMap.set(file, names)
    update(blocks)

    const imports = names.reduce((prev, curr) => {
      return `${prev}import ${curr} from "${resolve(`./${curr}.vue`)}"\n`
    }, '')
    const script = `<script setup>\n${imports}</script>`
    tree.children.splice(0, 0, { type: 'html', value: script })

    if (demoColumns > 1) {
      const vueNodesIds: number[] = []
      const vueNodes = tree.children.filter((item, index) => {
        if (item.meta === 'vue') {
          vueNodesIds.push(index)
          return true
        }
        return false
      }).map((item) => item.value);

      if (vueNodesIds.length) {
        tree.children.splice(vueNodesIds[0], 1, {
          type: 'html',
          value: `<VueMarkdown columns="${demoColumns}">${vueNodes.join('')}</VueMarkdown>`
        })
        tree.children = tree.children.filter((item) => item.meta !== 'vue')
      }
    }
    return tree
  }

  return transformer
}
