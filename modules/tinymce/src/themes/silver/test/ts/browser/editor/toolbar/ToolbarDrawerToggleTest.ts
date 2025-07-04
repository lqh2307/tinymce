import { TestStore, Waiter, FocusTools, Assertions, ApproxStructure } from '@ephox/agar';
import { context, describe, it } from '@ephox/bedrock-client';
import { Arr } from '@ephox/katamari';
import { SugarDocument } from '@ephox/sugar';
import { McEditor, TinyUiActions } from '@ephox/wrap-mcagar';
import { assert } from 'chai';

import Editor from 'tinymce/core/api/Editor';
import { RawEditorOptions, ToolbarMode } from 'tinymce/core/api/OptionTypes';

import * as UiUtils from '../../../module/UiUtils';

// TODO TINY-10480: Investigate flaky tests
describe('browser.tinymce.themes.silver.editor.toolbar.ToolbarDrawerToggleTest', () => {

  const assertToolbarToggleState = (editor: Editor, expected: boolean) => {
    const state = editor.queryCommandState('ToggleToolbarDrawer');
    assert.equal(state, expected, 'Expected toolbar toggle state to be ' + expected);
  };

  const pWaitForOverflowToolbar = async (editor: Editor, toolbarMode: ToolbarMode) => {
    const selector = `.tox-toolbar__overflow${toolbarMode === 'sliding' ? '--open' : ''}`;
    await TinyUiActions.pWaitForUi(editor, selector);
  };

  const pTestToggle = async (options: RawEditorOptions, shouldToggle: boolean) => {
    const editor = await McEditor.pFromSettings<Editor>({
      toolbar: 'undo redo | bold italic',
      menubar: false,
      statusbar: false,
      width: 200,
      ...options,
      base_url: '/project/tinymce/js/tinymce'
    });
    editor.focus();
    await UiUtils.pWaitForEditorToRender();
    assertToolbarToggleState(editor, false);
    editor.execCommand('ToggleToolbarDrawer');
    assertToolbarToggleState(editor, shouldToggle);
    editor.execCommand('ToggleToolbarDrawer');
    assertToolbarToggleState(editor, false);
    McEditor.remove(editor);
  };

  context.skip(`Using the 'ToggleToolbarDrawer' command should toggle the toolbar if applicable`, () => {
    Arr.each<{ mode: ToolbarMode; shouldToggle: boolean }>([
      { mode: 'floating', shouldToggle: true },
      { mode: 'sliding', shouldToggle: true },
      { mode: 'wrap', shouldToggle: false },
      { mode: 'scrolling', shouldToggle: false }
    ], (test) => {
      // Test iframe
      it(`TINY-6032: ${test.mode} toolbar`, () =>
        pTestToggle({ toolbar_mode: test.mode }, false)
      );

      it(`TINY-6032: ${test.mode} toolbar - small width`, () =>
        pTestToggle({ toolbar_mode: test.mode, width: 50 }, test.shouldToggle)
      );

      // Test inline
      it(`TINY-6032: ${test.mode} toolbar (inline)`, () =>
        pTestToggle({ toolbar_mode: test.mode, inline: true }, false)
      );

      it(`TINY-6032: ${test.mode} toolbar - small width (inline)`, () =>
        pTestToggle({ toolbar_mode: test.mode, width: 50, inline: true }, test.shouldToggle)
      );
    });

    it('TINY-6032: Multiple toolbars', () =>
      pTestToggle({ toolbar: [ 'undo redo', 'bold italic' ] }, false)
    );

    it('TINY-6032: Multiple toolbars (inline)', () =>
      pTestToggle({ toolbar: [ 'undo redo', 'bold italic' ], inline: true }, false)
    );
  });

  const pTestEvent = async (toolbarMode: ToolbarMode, command: (editor: Editor) => void) => {
    const editor = await McEditor.pFromSettings<Editor>({
      menubar: false,
      statusbar: false,
      width: 200,
      toolbar_mode: toolbarMode,
      base_url: '/project/tinymce/js/tinymce'
    });
    editor.focus();

    const store = TestStore<boolean>();
    await UiUtils.pWaitForEditorToRender();

    editor.on('ToggleToolbarDrawer', (options: { state: boolean }) => {
      store.add(options.state);
    });

    command(editor);
    await pWaitForOverflowToolbar(editor, toolbarMode);
    command(editor);
    await Waiter.pTryUntil('Wait for toolbar to be completely open', () => {
      store.sAssertEq('Assert store contains opened state', [ true, false ]);
    });
    McEditor.remove(editor);
  };

  context(`Should emit 'ToogleToolbarDrawer' event when toggled`, () => {
    Arr.each<ToolbarMode>([ 'floating', 'sliding' ], (toolbarMode) => {
      it(`TINY-9271: Emits 'ToggleToolbarDrawer' in ${toolbarMode} via execCommand`, async () => {
        await pTestEvent(toolbarMode, (editor) => editor.execCommand('ToggleToolbarDrawer'));
      });

      it(`TINY-9271: Emits 'ToggleToolbarDrawer' in ${toolbarMode} via user click`, async () => {
        await pTestEvent(toolbarMode, (editor) => TinyUiActions.clickOnToolbar(editor, 'button[data-mce-name="overflow-button"]'));
      });
    });
  });

  context(`Should preserve focus if skipFocus: true option was passed`, () => {
    Arr.each<ToolbarMode>([ 'floating', 'sliding' ], (toolbarMode) => {
      it(`TINY-9337: Preserves focus in ${toolbarMode} if skipFocus is true`, async () => {
        const editor = await McEditor.pFromSettings<Editor>({
          menubar: false,
          statusbar: false,
          width: 200,
          toolbar_mode: toolbarMode,
          base_url: '/project/tinymce/js/tinymce'
        });
        await UiUtils.pWaitForEditorToRender();
        editor.focus();

        const doc = SugarDocument.getDocument();
        FocusTools.isOnSelector('Root element is focused', doc, 'iframe');
        editor.execCommand('ToggleToolbarDrawer', false, { skipFocus: true });
        await pWaitForOverflowToolbar(editor, toolbarMode);
        await FocusTools.pTryOnSelector('Focus should be preserved', doc, 'iframe');
        editor.execCommand('ToggleToolbarDrawer', false, { skipFocus: true });
        await FocusTools.pTryOnSelector('Focus should be preserved', doc, 'iframe');
        McEditor.remove(editor);
      });

      it(`TINY-9337: Does not preserve focus in ${toolbarMode} if skipFocus is false`, async () => {
        const editor = await McEditor.pFromSettings<Editor>({
          menubar: false,
          statusbar: false,
          width: 200,
          toolbar_mode: toolbarMode,
          base_url: '/project/tinymce/js/tinymce'
        });
        await UiUtils.pWaitForEditorToRender();
        editor.focus();
        const initialFocusedElement = document.activeElement;
        editor.execCommand('ToggleToolbarDrawer', false, { skipFocus: false });
        await pWaitForOverflowToolbar(editor, toolbarMode);
        await Waiter.pTryUntil('Wait for toolbar to be completely open', () => {
          assert.notEqual(initialFocusedElement, document.activeElement, 'Focus should not be preserved');
        });
        editor.execCommand('ToggleToolbarDrawer', false, { skipFocus: false });
        await Waiter.pTryUntil('Wait for toolbar to be completely closed', () => {
          assert.notEqual(initialFocusedElement, document.activeElement, 'Focus should not be preserved');
        });
        McEditor.remove(editor);
      });
    });

    context('Assert overflow button structure when in sliding mode', () => {
      it(`TINY-10795: Overflow button should have aria-expanded when toggled`, async () => {
        const editor = await McEditor.pFromSettings<Editor>({
          menubar: false,
          statusbar: false,
          width: 200,
          toolbar_mode: 'sliding',
          base_url: '/project/tinymce/js/tinymce'
        });
        const toolbarButton = TinyUiActions.clickOnToolbar(editor, 'button[data-mce-name="overflow-button"]');
        await pWaitForOverflowToolbar(editor, 'sliding');
        Assertions.assertStructure('overflow button stucture', ApproxStructure.build((s, str) =>
          s.element('button', {
            attrs: {
              'aria-expanded': str.is('true'),
              'aria-pressed': str.none()
            }
          })
        ), toolbarButton);
        McEditor.remove(editor);
      });
    });
  });

  it('TINY-12125: Toolbar drawer should close when the editor loses focus', async () => {
    const editor = await McEditor.pFromSettings<Editor>({
      menubar: false,
      statusbar: false,
      width: 200,
      toolbar_mode: 'floating',
      base_url: '/project/tinymce/js/tinymce'
    });
    await UiUtils.pWaitForEditorToRender();

    assertToolbarToggleState(editor, false);

    TinyUiActions.clickOnUi(editor, 'button[data-mce-name="overflow-button"]');
    await pWaitForOverflowToolbar(editor, 'floating');

    editor.dispatch('blur');

    assertToolbarToggleState(editor, false);
    McEditor.remove(editor);
  });

  it('TINY-12125: Toolbar drawer should stay open when the editor loses focus if the toolbar is in sliding mode', async () => {
    const editor = await McEditor.pFromSettings<Editor>({
      menubar: false,
      statusbar: false,
      width: 200,
      toolbar_mode: 'sliding',
      base_url: '/project/tinymce/js/tinymce'
    });
    await UiUtils.pWaitForEditorToRender();

    assertToolbarToggleState(editor, false);

    TinyUiActions.clickOnUi(editor, 'button[data-mce-name="overflow-button"]');
    await pWaitForOverflowToolbar(editor, 'sliding');

    editor.dispatch('blur');

    await pWaitForOverflowToolbar(editor, 'sliding');
    McEditor.remove(editor);
  });
});
