import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import generatePkg from '@babel/generator';
import * as t from '@babel/types';

const traverse =
  typeof _traverse === 'function' ? _traverse : (_traverse as any).default;
const generate =
  typeof generatePkg === 'function'
    ? generatePkg
    : (generatePkg as any).default;

export function transformVBookScript(code: string): string {
  const ast = parse(code, { sourceType: 'script' });

  traverse(ast, {
    VariableDeclaration(path: any) {
      if (path.node.kind === 'var') {
        path.node.kind = 'let';
      }
    },
    CallExpression(path: any) {
      let shouldAwait = false;
      if (
        t.isIdentifier(path.node.callee, { name: 'fetch' }) ||
        t.isIdentifier(path.node.callee, { name: 'fetchPage' })
      ) {
        path.node.callee = t.identifier('vbookFetch');
        shouldAwait = true;
      }

      if (t.isMemberExpression(path.node.callee)) {
        const propName = (path.node.callee.property as any).name;
        if (['string', 'html', 'json', 'text'].includes(propName)) {
          shouldAwait = true;
        }

        if (['forEach', 'map'].includes(propName)) {
          const helperName =
            propName === 'forEach' ? '__vbook_forEach' : '__vbook_map';
          const object = (path.node.callee as t.MemberExpression).object;
          path.node.callee = t.identifier(helperName);
          path.node.arguments.unshift(object);
          shouldAwait = true;
        }
      }

      if (shouldAwait && !t.isAwaitExpression(path.parent)) {
        path.replaceWith(t.awaitExpression(path.node));
        // Propagate async to parent function to prevent syntax errors
        const parentFunc = path.findParent((p: any) => p.isFunction());
        if (parentFunc) {
          (parentFunc.node as t.Function).async = true;
        }
      }

      // Response.success/error is now handled by the global Response polyfill in plugin.ts
    },
  });

  let changed = true;
  while (changed) {
    changed = false;
    const asyncFuncNames = new Set<string>();

    traverse(ast, {
      Function(path: any) {
        if (path.node.async && path.node.id) {
          asyncFuncNames.add(path.node.id.name);
        }
      },
    });

    traverse(ast, {
      CallExpression(path: any) {
        if (
          t.isIdentifier(path.node.callee) &&
          asyncFuncNames.has(path.node.callee.name)
        ) {
          if (!t.isAwaitExpression(path.parent)) {
            path.replaceWith(t.awaitExpression(path.node));
            const parentFunc = path.findParent((p: any) => p.isFunction());
            if (parentFunc && !(parentFunc.node as t.Function).async) {
              (parentFunc.node as t.Function).async = true;
              changed = true;
            }
          }
        }
      },
    });
  }

  return generate(ast).code;
}
