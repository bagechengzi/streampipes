/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */


import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import Konva from 'konva';
import { Annotation } from '../../../core-model/coco/Annotation';
import { CocoFormat } from '../../../core-model/coco/Coco.format';
import { DatalakeRestService } from '../../../core-services/datalake/datalake-rest.service';
import { ImageContainerComponent } from '../components/image-container/image-container.component';
import { ICoordinates } from '../model/coordinates';
import { LabelingMode } from '../model/labeling-mode';
import { BrushLabelingService } from '../services/BrushLabeling.service';
import { CocoFormatService } from '../services/CocoFormat.service';
import { LabelingModeService } from '../services/LabelingMode.service';
import { PolygonLabelingService } from '../services/PolygonLabeling.service';
import { ReactLabelingService } from '../services/ReactLabeling.service';

@Component({
  selector: 'sp-image-labeling',
  templateUrl: './image-labeling.component.html',
  styleUrls: ['./image-labeling.component.css']
})
export class ImageLabelingComponent implements OnInit {

  // label
  public labels;
  public selectedLabel: {category, label};

  public _imagesRoutes
  @Input()
  set imagesRoutes(routes) {
   this._imagesRoutes = routes;
   this.getCocoFile(this._imagesRoutes, 0);
  }

  public imagesIndex = 0;

  public cocoFile: CocoFormat;

  public isHoverComponent;
  public brushSize: number;

  public isDrawing = false;

  @ViewChild(ImageContainerComponent) imageView: ImageContainerComponent;

  constructor(private restService: DatalakeRestService, private reactLabelingService: ReactLabelingService,
              private polygonLabelingService: PolygonLabelingService, private brushLabelingService: BrushLabelingService,
              private snackBar: MatSnackBar, private cocoFormatService: CocoFormatService,
              public labelingMode: LabelingModeService) { }

  ngOnInit(): void {
    this.isHoverComponent = false;
    this.brushSize = 5;
    this.labels = this.restService.getLabels();
  }

  handleImageIndexChange(index) {
    this.save(this.imagesIndex);
    this.getCocoFile(this._imagesRoutes, index);
  }

  getCocoFile(routes, index) {
      // This is relevant for coco
      this.restService.getCocoFileForImage(routes[index]).subscribe(
        coco => {
          if (coco === null) {
            const cocoFile = new CocoFormat();
            this.cocoFormatService.addImage(cocoFile, (routes[index]));
            this.cocoFile = cocoFile;
          } else {
            this.cocoFile = coco as CocoFormat;
          }
          this.imagesIndex = index;
        }
      );
  }

  /* sp-image-view handler */
  handleMouseDownLeft(layer: Konva.Layer, shift: ICoordinates, position: ICoordinates) {
    if (this.labelingEnabled()) {
      switch (this.labelingMode.getMode()) {
        case LabelingMode.ReactLabeling: this.reactLabelingService.startLabeling(position);
          break;
        case LabelingMode.PolygonLabeling: this.polygonLabelingService.startLabeling(position);
          break;
        case LabelingMode.BrushLabeling: this.brushLabelingService.startLabeling(position, this.brushSize);
      }
    }
  }

  handleMouseMove(layer: Konva.Layer, shift: ICoordinates, position: ICoordinates) {
    switch (this.labelingMode.getMode()) {
      case LabelingMode.PolygonLabeling: {
        this.polygonLabelingService.executeLabeling(position);
        this.polygonLabelingService.tempDraw(layer, shift, this.selectedLabel.label);
      }
    }
  }

  handleMouseMoveLeft(layer: Konva.Layer, shift: ICoordinates, position: ICoordinates) {
    if (this.labelingEnabled()) {
      switch (this.labelingMode.getMode()) {
        case LabelingMode.ReactLabeling: {
          this.reactLabelingService.executeLabeling(position);
          this.reactLabelingService.tempDraw(layer, shift, this.selectedLabel.label);
        }
          break;
        case  LabelingMode.BrushLabeling: {
          this.brushLabelingService.executeLabeling(position);
          this.brushLabelingService.tempDraw(layer, shift, this.selectedLabel.label);
        }
      }
    }
  }

  handleMouseUpLeft(annotationLayer: Konva.Layer, drawLayer: Konva.Layer, shift: ICoordinates, position: ICoordinates) {
    if (this.labelingEnabled()) {
      switch (this.labelingMode.getMode()) {
        case LabelingMode.ReactLabeling: {
          const result = this.reactLabelingService.endLabeling(position);
          const coco = this.cocoFile;
          const annotation = this.cocoFormatService.addReactAnnotationToFirstImage(coco, result[0], result[1],
            this.selectedLabel.category, this.selectedLabel.label);
          this.reactLabelingService.draw(annotationLayer, shift, annotation, this.imageView);
        }
          break;
        case LabelingMode.PolygonLabeling: {
          this.polygonLabelingService.tempDraw(drawLayer, shift, this.selectedLabel.label);
        }
          break;
        case LabelingMode.BrushLabeling: {
          const result = this.brushLabelingService.endLabeling(position);
          const coco = this.cocoFile;
          const annotation = this.cocoFormatService.addBrushAnnotationFirstImage(coco, result[0], result[1],
            this.selectedLabel.category, this.selectedLabel.label);
          this.brushLabelingService.draw(annotationLayer, shift, annotation, this.imageView);
        }
      }
    }
  }

  handleMouseDownRight(layer: Konva.Layer, shift: ICoordinates, position: ICoordinates) {
    this.labelingMode.toggleNoneMode();
  }


  handleImageViewDBClick(layer: Konva.Layer, shift: ICoordinates, position: ICoordinates) {
    if (this.labelingEnabled()) {
      switch (this.labelingMode.getMode()) {
        case LabelingMode.PolygonLabeling:
          const points = this.polygonLabelingService.endLabeling(position);
          const coco = this.cocoFile;
          const annotation = this.cocoFormatService.addPolygonAnnotationFirstImage(coco, points,
            this.selectedLabel.category, this.selectedLabel.label);
          this.polygonLabelingService.draw(layer, shift, annotation, this.imageView);
      }
    }
  }

  handleChildRedraw(layer: Konva.Layer, shift: ICoordinates) {
    const coco = this.cocoFile;
    if (coco  !== undefined) {
      for (const annotation of coco.annotations) {
        annotation.isHovered = false;
        annotation.isSelected = false;
        if (this.cocoFormatService.isBoxAnnonation(annotation)) {
          this.reactLabelingService.draw(layer, shift, annotation, this.imageView);
        } else if (this.cocoFormatService.isPolygonAnnonation(annotation) && !this.cocoFormatService.isBrushAnnonation(annotation)) {
          this.polygonLabelingService.draw(layer, shift, annotation, this.imageView);
        } else if (this.cocoFormatService.isBrushAnnonation(annotation)) {
          this.brushLabelingService.draw(layer, shift, annotation, this.imageView);
        }
      }
    }
  }

  handleImageViewShortCuts(key) {
    if (key === 'delete') {
      const coco = this.cocoFile;
      const toDelete = coco.annotations.filter(anno => anno.isSelected);
      for (const anno of toDelete) {
        this.handleDeleteAnnotation(anno);
      }
    }
  }

  handleIsDrawing(bool: boolean) {
    this.isDrawing = bool;
  }

  /* sp-image-labels handler */
  handleLabelChange(label: {category, label}) {
    this.selectedLabel = label;
  }


  /* sp-image-annotations handlers */
  handleChangeAnnotationLabel(change: [Annotation, string, string]) {
    if (!this.isDrawing) {
      const coco = this.cocoFile;
      const categoryId = this.cocoFormatService.getLabelId(coco, change[1], change[2]);
      change[0].category_id = categoryId;
      change[0].category_name = change[2];
      this.imageView.redrawAll();
    }
  }

  handleDeleteAnnotation(annotation) {
    if (!this.isDrawing) {
      if (annotation !== undefined) {
        const coco = this.cocoFile;
        this.cocoFormatService.removeAnnotation(coco, annotation.id);
        this.imageView.redrawAll();
      }
    }
  }

  /* utils */

  private labelingEnabled() {
    const coco = this.cocoFile;
    const annotation = coco.annotations.find(anno => anno.isHovered && anno.isSelected);
    if (annotation !== undefined) {
      return false;
    } else {
      return true;
    }
  }

  save(imageIndex) {
    const coco = this.cocoFile;
    if (coco !== undefined) {
      const imageRoute = this._imagesRoutes[imageIndex];
      this.restService.saveCocoFileForImage(imageRoute, JSON.stringify(coco)).subscribe(
        res =>    this.openSnackBar('Saved')
      );
    }
  }

  private openSnackBar(message: string) {
    this.snackBar.open(message, '', {
      duration: 2000,
      verticalPosition: 'top',
      horizontalPosition: 'right'
    });
  }


}
